"use client"

import type React from "react"

import NextImage from "next/image"
import { useState, useRef, useEffect, useCallback } from "react"

const OFFSET_ARRAY = [-0.02, 0.01, -0.01, 0.02] as const
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))

const TURBULENCE_SEED = 1

type OverlayScope = "none" | "artboard" | "viewport"
type OverlaySlot = "A" | "B"

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
  const vwp = (px: number) => `${Math.round(px * viewportScale)}px`
  const vhp = (px: number) => `${Math.round(px * viewportScale)}px`
  const ANGLE_MAX = 360
  const TREMOR_MIN = 0.001
  const TREMOR_MAX = 0.050
  const INTENSITY_MIN = 1.0
  const INTENSITY_MAX = 20.0
  const valueToAngle = useCallback((val: number, min: number, max: number) => {
    const frac = clamp((val - min) / (max - min), 0, 1)
    if (frac >= 1) return ANGLE_MAX - 0.001
    return frac * ANGLE_MAX
  }, [ANGLE_MAX])
  const [viewportScale, setViewportScale] = useState(1)
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
  const [animationScale, setAnimationScale] = useState(0.2)
  const [animationSpeed, setAnimationSpeed] = useState(100) // milliseconds
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [svgContent, setSvgContent] = useState(`
    <path d="M50,50 L150,50 L150,150 L50,150 Z" fill="#3498db" stroke="#2980b9" strokeWidth="2"/>
    <circle cx="100" cy="100" r="30" fill="#e74c3c" stroke="#c0392b" strokeWidth="2"/>
    <line x1="60" y1="60" x2="140" y2="140" stroke="#f1c40f" strokeWidth="3"/>
  `)
  const [originalWidth, setOriginalWidth] = useState(200)
  const [originalHeight, setOriginalHeight] = useState(200)
  const [scaledViewBox, setScaledViewBox] = useState("0 0 200 200")
  const [tremorValue, setTremorValue] = useState(TREMOR_MIN)
  const [intensityValue, setIntensityValue] = useState(INTENSITY_MIN)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [currentRotation2, setCurrentRotation2] = useState(0)

  const isDraggingRef = useRef(false)
  const isDragging2Ref = useRef(false)
  const startAngleRef = useRef(0)
  const startAngle2Ref = useRef(0)

  const tremorValueRef = useRef(TREMOR_MIN)
  const intensityValueRef = useRef(INTENSITY_MIN)
  const currentRotationRef = useRef(0)
  const currentRotation2Ref = useRef(0)

  const animatedSvgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationIntervalRef = useRef<number | null>(null)
  const currentIndexRef = useRef(0)

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

  useEffect(() => {
    const handleResize = () => {
      const widthScale = window.innerWidth / (DESIGN_WIDTH + DESIGN_PADDING * 2)
      const heightScale = window.innerHeight / (DESIGN_HEIGHT + DESIGN_PADDING * 2)
      setViewportScale(Math.min(widthScale, heightScale, VIEWPORT_SCALE_MAX))
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [DESIGN_WIDTH, DESIGN_HEIGHT, DESIGN_PADDING, VIEWPORT_SCALE_MAX])

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

    const offset = OFFSET_ARRAY[currentIndexRef.current]
    let newBaseFrequency = tremorValue + offset * animationScale

    // 항상 양수 유지
    newBaseFrequency = Math.max(0.0001, newBaseFrequency)

    const turbulence = svg.querySelector("feTurbulence")
    const displacement = svg.querySelector("feDisplacementMap")

    if (turbulence) {
      turbulence.setAttribute("baseFrequency", newBaseFrequency.toString())
    }
    if (displacement) {
      displacement.setAttribute("scale", intensityValue.toString())
    }

    currentIndexRef.current = (currentIndexRef.current + 1) % OFFSET_ARRAY.length
  }, [tremorValue, intensityValue, animationScale])

  const syncDialFilterValues = useCallback((nextTremorValue: number, nextIntensityValue: number) => {
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

  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
    setIsAnimating(false)
    
    // 애니메이션 정지 후에도 필터는 현재 다이얼 값으로 유지
    setTimeout(() => {
      const svg = animatedSvgRef.current
      if (svg) {
        const turbulence = svg.querySelector("feTurbulence")
        const displacement = svg.querySelector("feDisplacementMap")
        
        if (turbulence) {
          turbulence.setAttribute("baseFrequency", Math.max(0.0001, tremorValue).toString())
        }
        if (displacement) {
          displacement.setAttribute("scale", intensityValue.toString())
        }
      }
    }, 10)
  }, [intensityValue, tremorValue])

  const resetValues = () => {
    tremorValueRef.current = TREMOR_MIN
    intensityValueRef.current = INTENSITY_MIN
    currentRotationRef.current = 0
    currentRotation2Ref.current = 0
    setTremorValue(TREMOR_MIN)
    setIntensityValue(INTENSITY_MIN)
    setCurrentRotation(0)
    setCurrentRotation2(0)
    setAnimationScale(0.2)
    setAnimationSpeed(100)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    resetValues()
    const file = event.target.files?.[0]
    if (!file) return

    const fileType = file.type
    
    if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
      // Handle SVG files as before
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const parser = new DOMParser()
        const doc = parser.parseFromString(content, "image/svg+xml")
        const svgElement = doc.querySelector("svg")

        if (svgElement) {
          // Extract inner content (excluding svg wrapper)
          setSvgContent(svgElement.innerHTML)
          
          // Extract viewBox, width, and height
            const viewBox = svgElement.getAttribute("viewBox") || "0 0 200 200"
          
          const width = svgElement.getAttribute("width")
          const height = svgElement.getAttribute("height")
          
          // If width and height are not specified, calculate from viewBox
          let svgWidth = 200
          let svgHeight = 200
          
          if (width && height) {
            svgWidth = parseInt(width, 10)
            svgHeight = parseInt(height, 10)
          } else {
            const viewBoxValues = viewBox.split(" ").map(Number)
            if (viewBoxValues.length === 4) {
              svgWidth = viewBoxValues[2]
              svgHeight = viewBoxValues[3]
            }
          }
          
          setOriginalWidth(svgWidth)
          setOriginalHeight(svgHeight)
        }
      }
      reader.readAsText(file)
    } else if (fileType === 'image/png' || fileType === 'image/jpeg' || fileType === 'image/jpg') {
      // Handle PNG/JPG files with imagetracerjs
      try {
        // Dynamic import to avoid SSR issues
        const ImageTracer = (await import('imagetracerjs')).default

        const reader = new FileReader()
        reader.onload = (e) => {
          const imgElement = document.createElement("img")
          imgElement.onload = () => {
            const maxWidth = CANVAS_UPLOAD_MAX_WIDTH
             let scaledWidth = imgElement.width
             let scaledHeight = imgElement.height
            
             if (imgElement.width > maxWidth) {
               const scaleRatio = maxWidth / imgElement.width
               scaledWidth = maxWidth
               scaledHeight = imgElement.height * scaleRatio
             }
            
            // Create canvas to get image data
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            canvas.width = scaledWidth
            canvas.height = scaledHeight
            ctx.drawImage(imgElement, 0, 0, scaledWidth, scaledHeight)
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            
            // Convert to SVG using ImageTracer
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
              blurdelta: 20
            })

            // Parse the generated SVG
            const parser = new DOMParser()
            const doc = parser.parseFromString(svgString, "image/svg+xml")
            const svgElement = doc.querySelector("svg")

            if (svgElement) {
              // Extract inner content (excluding svg wrapper)
              setSvgContent(svgElement.innerHTML)
              
              // Set dimensions based on scaled image
              setOriginalWidth(scaledWidth)
              setOriginalHeight(scaledHeight)
            setScaledViewBox(`0 0 ${scaledWidth} ${scaledHeight}`)
            }
          }
          imgElement.src = e.target?.result as string
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error('Error converting image to SVG:', error)
      }
    }
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAnimating) {
      startAnimation()
    }
  }, [animationSpeed, isAnimating, startAnimation])

  // 볼륨 다이얼 관련 함수들
  const getAngle = useCallback((centerX: number, centerY: number, clientX: number, clientY: number) => {
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI)
  }, [])

  const updateDialFromValues = useCallback((dialNumber: 1 | 2, nextValue: number) => {
    if (dialNumber === 1) {
      const clamped = clamp(nextValue, TREMOR_MIN, TREMOR_MAX)
      tremorValueRef.current = clamped
      currentRotationRef.current = valueToAngle(clamped, TREMOR_MIN, TREMOR_MAX)
      setTremorValue(clamped)
      setCurrentRotation(currentRotationRef.current)
      syncDialFilterValues(clamped, intensityValueRef.current)
      return
    }

    const clamped = clamp(nextValue, INTENSITY_MIN, INTENSITY_MAX)
    intensityValueRef.current = clamped
    currentRotation2Ref.current = valueToAngle(clamped, INTENSITY_MIN, INTENSITY_MAX)
    setIntensityValue(clamped)
    setCurrentRotation2(currentRotation2Ref.current)
    syncDialFilterValues(tremorValueRef.current, clamped)
  }, [INTENSITY_MAX, INTENSITY_MIN, TREMOR_MAX, TREMOR_MIN, syncDialFilterValues, valueToAngle])

  const updateTremorValue = useCallback((angleDiff: number, dialNumber: 1 | 2 = 1) => {
    let nextTremorValue = tremorValueRef.current
    let nextIntensityValue = intensityValueRef.current

    if (dialNumber === 1) {
      const valueRange = TREMOR_MAX - TREMOR_MIN
      const valueChange = (angleDiff / 360) * valueRange
      const unclamped = tremorValueRef.current + valueChange
      nextTremorValue = clamp(Math.max(0.0001, unclamped), TREMOR_MIN, TREMOR_MAX)

      tremorValueRef.current = nextTremorValue
      currentRotationRef.current = valueToAngle(nextTremorValue, TREMOR_MIN, TREMOR_MAX)
      setTremorValue(nextTremorValue)
      setCurrentRotation(currentRotationRef.current)
    } else {
      const valueRange = INTENSITY_MAX - INTENSITY_MIN
      const valueChange = (angleDiff / 360) * valueRange
      const unclamped = intensityValueRef.current + valueChange
      nextIntensityValue = clamp(Math.max(INTENSITY_MIN, unclamped), INTENSITY_MIN, INTENSITY_MAX)

      intensityValueRef.current = nextIntensityValue
      currentRotation2Ref.current = valueToAngle(nextIntensityValue, INTENSITY_MIN, INTENSITY_MAX)
      setIntensityValue(nextIntensityValue)
      setCurrentRotation2(currentRotation2Ref.current)
    }

    // 즉시 필터 업데이트 (드래그 중 실시간 반영)
    syncDialFilterValues(tremorValueRef.current, intensityValueRef.current)
  }, [INTENSITY_MAX, INTENSITY_MIN, TREMOR_MAX, TREMOR_MIN, syncDialFilterValues, valueToAngle])

  const DIAL_KEY_STEP = 10

  const handleDialKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, dialNumber: 1 | 2) => {
    const isTremorDial = dialNumber === 1
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault()
      stopAnimation()
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      updateTremorValue(-DIAL_KEY_STEP, dialNumber)
      startAnimation()
      return
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      updateTremorValue(DIAL_KEY_STEP, dialNumber)
      startAnimation()
      return
    }

    if (event.key === "Home") {
      updateDialFromValues(dialNumber, isTremorDial ? TREMOR_MIN : INTENSITY_MIN)
      startAnimation()
      return
    }

    if (event.key === "End") {
      updateDialFromValues(dialNumber, isTremorDial ? TREMOR_MAX : INTENSITY_MAX)
      startAnimation()
    }
  }, [startAnimation, stopAnimation, updateDialFromValues, updateTremorValue])

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>, dialNumber: 1 | 2) => {
    // 애니메이션만 중지, 필터는 유지
    stopAnimation()

    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    if (dialNumber === 1) {
      isDraggingRef.current = true
      startAngleRef.current = getAngle(centerX, centerY, e.clientX, e.clientY)
    } else {
      isDragging2Ref.current = true
      startAngle2Ref.current = getAngle(centerX, centerY, e.clientX, e.clientY)
    }
    e.preventDefault()
  }

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>, dialNumber: 1 | 2) => {
    stopAnimation()

    const touch = e.touches[0]
    if (!touch) return

    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    if (dialNumber === 1) {
      isDraggingRef.current = true
      startAngleRef.current = getAngle(centerX, centerY, touch.clientX, touch.clientY)
    } else {
      isDragging2Ref.current = true
      startAngle2Ref.current = getAngle(centerX, centerY, touch.clientX, touch.clientY)
    }
    e.preventDefault()
  }, [getAngle, stopAnimation])

  const handleDocumentTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return

    if (isDraggingRef.current) {
      const volumeDial = document.getElementById('tremor-circle')
      if (volumeDial) {
        const rect = volumeDial.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, touch.clientX, touch.clientY)
        let angleDiff = currentAngle - startAngleRef.current

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        updateTremorValue(angleDiff, 1)
        startAngleRef.current = currentAngle
      }
    }

    if (isDragging2Ref.current) {
      const volumeDial2 = document.getElementById('tremor-circle-2')
      if (volumeDial2) {
        const rect = volumeDial2.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, touch.clientX, touch.clientY)
        let angleDiff = currentAngle - startAngle2Ref.current

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        updateTremorValue(angleDiff, 2)
        startAngle2Ref.current = currentAngle
      }
    }

    e.preventDefault()
  }, [getAngle, updateTremorValue])

  const handleDocumentTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    isDragging2Ref.current = false
    setTimeout(() => {
      applyFilters()
    }, 10)
    startAnimation()
  }, [applyFilters, startAnimation])

  const handleDocumentMouseMove = useCallback((event: MouseEvent) => {
    if (isDraggingRef.current) {
      const volumeDial = document.getElementById('tremor-circle')
      if (volumeDial) {
        const rect = volumeDial.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, event.clientX, event.clientY)
        let angleDiff = currentAngle - startAngleRef.current

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        updateTremorValue(angleDiff, 1)
        startAngleRef.current = currentAngle
      }
    }

    if (isDragging2Ref.current) {
      const volumeDial2 = document.getElementById('tremor-circle-2')
      if (volumeDial2) {
        const rect = volumeDial2.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, event.clientX, event.clientY)
        let angleDiff = currentAngle - startAngle2Ref.current

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        updateTremorValue(angleDiff, 2)
        startAngle2Ref.current = currentAngle
      }
    }
  }, [getAngle, updateTremorValue])

  const handleDocumentMouseUp = useCallback(() => {
    isDraggingRef.current = false
    isDragging2Ref.current = false

    // 드래그 종료 후 전체 필터를 다시 적용하여 지속성 보장
    setTimeout(() => {
      applyFilters()
    }, 10) // 짧은 지연으로 상태 업데이트 완료 후 적용

    // 애니메이션 재시작
    startAnimation()
  }, [applyFilters, startAnimation])

  // 마우스 이벤트 리스너 추가
  useEffect(() => {
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
    document.addEventListener('touchend', handleDocumentTouchEnd, { passive: false })

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
      document.removeEventListener('touchmove', handleDocumentTouchMove)
      document.removeEventListener('touchend', handleDocumentTouchEnd)
    }
  }, [
    handleDocumentMouseMove,
    handleDocumentMouseUp,
    handleDocumentTouchMove,
    handleDocumentTouchEnd,
  ])

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
        left: vwp(30),
        top: vhp(65),
        width: vwp(350),
        height: vhp(511)
      }}>
        <NextImage src="/svg/Rectangle-267.svg" alt="Canvas background" width={378} height={519} style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 0,
          right: vwp(10),
          bottom: vhp(30)
        }} />
        <div style={{
          position: 'absolute',
          left: vwp(3),
          top: vhp(10),
          width: vwp(CANVAS_AREA_WIDTH),
          height: vhp(CANVAS_AREA_HEIGHT),
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
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
      
      {/* 볼륨 다이얼들 */}
      <div style={{
        position: 'absolute',
        left: vwp(50),
        top: vhp(559),
        width: vwp(290),
        height: vhp(167),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* 첫 번째 다이얼 - 떨림 세기 */}
        <div style={{
          width: vwp(130),
          height: vwp(130),
          position: 'relative'
        }}>
          {/* Radial Elements */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: vwp(85),
            height: vwp(85)
          }}>
            {Array.from({ length: 24 }, (_, i) => {
              const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transformOrigin: '50% 50%',
                    transform: `translate(-50%, -50%) rotate(${angles[i]}deg) translateY(calc(-1 * ${vwp(60)}))`
                  }}
                >
              <NextImage src="/svg/Vector 98.svg" alt="Radial element" width={5} height={19} style={{ transform: 'scale(1.0)', display: 'block' }} />
                </div>
              )
            })}
          </div>
          {/* 다이얼 중앙 */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: vwp(85),
            height: vwp(85),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <button
              id="tremor-circle"
              type="button"
              className="control-button"
              role="slider"
              aria-label="떨림 세기 조절"
              aria-describedby="tremor-value"
              aria-valuemin={TREMOR_MIN}
              aria-valuemax={TREMOR_MAX}
              aria-valuenow={tremorValue}
              onMouseDown={(e) => handleMouseDown(e, 1)}
              onTouchStart={(e) => handleTouchStart(e, 1)}
              onKeyDown={(e) => handleDialKeyDown(e, 1)}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              <NextImage 
                src="/svg/Group 241.svg" 
                alt="Tremor circle" 
                width={116}
                height={117}
                style={{
                  width: '100%',
                  height: '100%',
                  transformOrigin: 'center center',
                  transform: `rotate(${currentRotation}deg)`,
                  transition: 'transform 80ms linear',
                  willChange: 'transform',
                  filter: 'none'
                }}
              />
            </button>
          </div>
        </div>
        
        {/* 두 번째 다이얼 - 효과 강도 */}
        <div style={{
          width: vwp(130),
          height: vwp(130),
          position: 'relative'
        }}>
          {/* Radial Elements */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: vwp(85),
            height: vwp(85)
          }}>
            {Array.from({ length: 24 }, (_, i) => {
              const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transformOrigin: '50% 50%',
                    transform: `translate(-50%, -50%) rotate(${angles[i]}deg) translateY(calc(-1 * ${vwp(60)}))`
                  }}
                >
              <NextImage src="/svg/Vector 98.svg" alt="Radial element" width={5} height={19} style={{ transform: 'scale(1.0)', display: 'block' }} />
                </div>
              )
            })}
          </div>
          {/* 다이얼 중앙 */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: vwp(85),
            height: vwp(85),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <button
              id="tremor-circle-2"
              type="button"
              className="control-button"
              role="slider"
              aria-label="강도 조절"
              aria-describedby="intensity-value"
              aria-valuemin={INTENSITY_MIN}
              aria-valuemax={INTENSITY_MAX}
              aria-valuenow={intensityValue}
              onMouseDown={(e) => handleMouseDown(e, 2)}
              onTouchStart={(e) => handleTouchStart(e, 2)}
              onKeyDown={(e) => handleDialKeyDown(e, 2)}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              <NextImage 
                src="/svg/Group 241-4.svg" 
                alt="Intensity circle" 
                width={116}
                height={117}
                style={{
                  width: '100%',
                  height: '100%',
                  transformOrigin: 'center center',
                  transform: `rotate(${currentRotation2}deg)`,
                  transition: 'transform 80ms linear',
                  willChange: 'transform',
                  filter: 'none'
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 텍스트 라벨들 */}
      <div style={{
        position: 'absolute',
        left: vwp(30),
        top: vhp(740),
        fontSize: vwp(25),
        color: 'rgb(0, 0, 0)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 'normal',
        width: vwp(140)
      }}>
        떨림 세기 : <span id="tremor-value" role="status" aria-live="polite" style={{ display: 'inline-block', width: vwp(50), textAlign: 'left', fontWeight: 'bold' }}>{tremorValue.toFixed(3)}</span>
      </div>
      
      <div style={{
        position: 'absolute',
        left: vwp(220),
        top: vhp(740),
        fontSize: vwp(25),
        color: 'rgb(0, 0, 0)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 'normal',
        width: vwp(140),
        right: 0
      }}>
        세기 강도 : <span id="intensity-value" role="status" aria-live="polite" style={{ display: 'inline-block', width: vwp(40), textAlign: 'left', fontWeight: 'bold' }}>{intensityValue.toFixed(1)}</span>
      </div>

      <div style={{
        position: 'absolute',
        left: vwp(30),
        top: vhp(770),
        width: vwp(333),
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
          min={0}
          max={1}
          step={0.01}
          value={animationScale}
          onChange={(e) => setAnimationScale(Number(e.target.value))}
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

      {/* 하단 툴바 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: vhp(802),
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
      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
    </div>
  )
}
