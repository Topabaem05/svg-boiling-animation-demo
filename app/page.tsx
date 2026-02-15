"use client"

import type React from "react"

import NextImage from "next/image"
import { useState, useRef, useEffect, useCallback } from "react"

const OFFSET_ARRAY = [-0.02, 0.01, -0.01, 0.02] as const
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))

const UI_REFERENCE = {
  iphone16_9: {
    label: "iPhone 16 - 9 (393x852)",
    src: "/ui-reference/iphone-16-9.png",
    width: 393,
    height: 852,
  },
  iphone16_10: {
    label: "iPhone 16 - 10 (744x1133)",
    src: "/ui-reference/iphone-16-10.png",
    width: 744,
    height: 1133,
  },
} as const

type OverlayScope = "none" | "artboard" | "viewport"
type OverlayImage = keyof typeof UI_REFERENCE

type OverlaySettings = {
  scope: OverlayScope
  image: OverlayImage
  opacity: number
}

const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  scope: "none",
  image: "iphone16_9",
  opacity: 0.35,
}

export default function SVGBoilingAnimation() {
  const DESIGN_WIDTH = 393
  const DESIGN_HEIGHT = 852
  const DESIGN_PADDING = 16
  const VIEWPORT_SCALE_MAX = Math.min(
    UI_REFERENCE.iphone16_10.width / (DESIGN_WIDTH + DESIGN_PADDING * 2),
    UI_REFERENCE.iphone16_10.height / (DESIGN_HEIGHT + DESIGN_PADDING * 2)
  )
  const CANVAS_AREA_WIDTH = 315
  const CANVAS_AREA_HEIGHT = 445
  const CANVAS_VIEWBOX_WIDTH = 315
  const CANVAS_VIEWBOX_HEIGHT = 445
  const CANVAS_UPLOAD_MAX_WIDTH = 310
  const vwp = (px: number) => `${Math.round(px * viewportScale)}px`
  const vhp = (px: number) => `${Math.round(px * viewportScale)}px`
  const ANGLE_MAX = 350
  const TREMOR_MIN = 0.001
  const TREMOR_MAX = 0.050
  const INTENSITY_MIN = 1.0
  const INTENSITY_MAX = 20.0
  const valueToAngle = useCallback((val: number, min: number, max: number) => {
    const frac = clamp((val - min) / (max - min), 0, 1)
    return frac * ANGLE_MAX
  }, [ANGLE_MAX])
  const [viewportScale, setViewportScale] = useState(1)
  const scaledPadding = Math.round(DESIGN_PADDING * viewportScale)
  const scaledDesignWidth = Math.round(DESIGN_WIDTH * viewportScale)
  const scaledDesignHeight = Math.round(DESIGN_HEIGHT * viewportScale)
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  const [overlay, setOverlay] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS)
  const overlaySrc = UI_REFERENCE[overlay.image].src
  const overlayOpacity = clamp(overlay.opacity, 0, 1)
  const animationScale = 0.2 // 고정값으로 설정
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
  const [isDragging, setIsDragging] = useState(false)
  const [isDragging2, setIsDragging2] = useState(false)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [currentRotation2, setCurrentRotation2] = useState(0)
  const [startAngle, setStartAngle] = useState(0)
  const [startAngle2, setStartAngle2] = useState(0)

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
      const parsed = JSON.parse(raw) as Partial<OverlaySettings>

      const nextScope =
        parsed.scope === "none" || parsed.scope === "artboard" || parsed.scope === "viewport"
          ? parsed.scope
          : DEFAULT_OVERLAY_SETTINGS.scope

      const nextImage =
        parsed.image === "iphone16_9" || parsed.image === "iphone16_10"
          ? parsed.image
          : DEFAULT_OVERLAY_SETTINGS.image

      const nextOpacity =
        typeof parsed.opacity === "number"
          ? clamp(parsed.opacity, 0, 1)
          : DEFAULT_OVERLAY_SETTINGS.opacity

      setOverlay({ scope: nextScope, image: nextImage, opacity: nextOpacity })
    } catch (error) {
      console.error("Failed to load overlay settings:", error)
    }
  }, [])

  useEffect(() => {
    if (!showOverlayPanel) return
    try {
      localStorage.setItem("boling:ui-overlay", JSON.stringify(overlay))
    } catch (error) {
      console.error("Failed to persist overlay settings:", error)
    }
  }, [overlay, showOverlayPanel])

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
    setTremorValue(0.001)
    setIntensityValue(1.0)
    setCurrentRotation(0)
    setCurrentRotation2(0)
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

  const exportAnimatedSVG = () => {
    // Convert animationSpeed to seconds for SVG animation
    const animationDuration = (animationSpeed * OFFSET_ARRAY.length) / 1000

    // Use the same scaled viewBox as the animation canvas
    const exportWidth = 500
    const exportHeight = 500
    const exportViewBox = scaledViewBox

    // 애니메이션 값에서도 항상 양수 유지
    const animatedValues = OFFSET_ARRAY.map((offset) => {
      let val = tremorValue + offset * animationScale
      val = Math.max(0.0001, val)
      return val
    }).join(';') + `;${Math.max(0.0001, tremorValue + OFFSET_ARRAY[0] * animationScale)}`

    // Create animated SVG with SMIL animations
    const animatedSvgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${exportViewBox}" width="${exportWidth}" height="${exportHeight}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="boilingFilter" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="turbulence" baseFrequency="${Math.max(0.0001, tremorValue)}" numOctaves="2" result="noise">
            <animate attributeName="baseFrequency" 
              values="${animatedValues}"
              dur="${animationDuration}s" 
              repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${intensityValue}" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <g filter="url(#boilingFilter)">
        ${svgContent}
      </g>
    </svg>
  `

    const blob = new Blob([animatedSvgContent], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "animated-boiling.svg"
    a.click()
    URL.revokeObjectURL(url)
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

  // 컴포넌트 마운트 시 초기 설정
  useEffect(() => {
    // 초기 각도를 값에 맞춰 0~350도로 설정
    setCurrentRotation(valueToAngle(TREMOR_MIN, TREMOR_MIN, TREMOR_MAX))
    setCurrentRotation2(valueToAngle(INTENSITY_MIN, INTENSITY_MIN, INTENSITY_MAX))

    // 초기 필터 적용
    const timer = setTimeout(() => {
      applyFilters()
    }, 100) // DOM이 완전히 렌더링된 후 적용

    // 애니메이션 시작
    startAnimation()

    return () => {
      clearTimeout(timer)
      stopAnimation()
    }
  }, [applyFilters, startAnimation, stopAnimation, valueToAngle])

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
      setTremorValue(clamped)
      setCurrentRotation(valueToAngle(clamped, TREMOR_MIN, TREMOR_MAX))
      syncDialFilterValues(clamped, intensityValue)
      return
    }

    const clamped = clamp(nextValue, INTENSITY_MIN, INTENSITY_MAX)
    setIntensityValue(clamped)
    setCurrentRotation2(valueToAngle(clamped, INTENSITY_MIN, INTENSITY_MAX))
    syncDialFilterValues(tremorValue, clamped)
  }, [INTENSITY_MAX, INTENSITY_MIN, TREMOR_MAX, TREMOR_MIN, intensityValue, syncDialFilterValues, tremorValue, valueToAngle])

  const updateTremorValue = useCallback((angleDiff: number, dialNumber = 1) => {
    let newTremorValue = tremorValue
    let newIntensityValue = intensityValue
    
    if (dialNumber === 1) {
      // 떨림 다이얼 (0.001 - 0.050)
      const minTremorValue = TREMOR_MIN
      const maxTremorValue = TREMOR_MAX
      const valueRange = maxTremorValue - minTremorValue
      const valueChange = (angleDiff / 360) * valueRange
      const newValue = tremorValue + valueChange
      
      if (newValue <= minTremorValue) {
        newTremorValue = minTremorValue
        setTremorValue(minTremorValue)
        // 각도도 0도로 설정
        setCurrentRotation(0)
        if (angleDiff < 0) return false
      } else if (newValue >= maxTremorValue) {
        newTremorValue = maxTremorValue
        setTremorValue(maxTremorValue)
        // 각도도 최댓값(350도)으로 설정
        setCurrentRotation(ANGLE_MAX)
        if (angleDiff > 0) return false
      } else {
        newTremorValue = Math.max(0.0001, newValue) // 항상 양수 유지
        setTremorValue(newTremorValue)
        setCurrentRotation(valueToAngle(newTremorValue, minTremorValue, maxTremorValue))
      }
    } else {
      // 강도 다이얼 (1.0 - 20.0)
      const minIntensityValue = INTENSITY_MIN
      const maxIntensityValue = INTENSITY_MAX
      const valueRange = maxIntensityValue - minIntensityValue
      const valueChange = (angleDiff / 360) * valueRange
      const newValue = intensityValue + valueChange
      
      if (newValue <= minIntensityValue) {
        newIntensityValue = minIntensityValue
        setIntensityValue(minIntensityValue)
        setCurrentRotation2(0)
        if (angleDiff < 0) return false
      } else if (newValue >= maxIntensityValue) {
        newIntensityValue = maxIntensityValue
        setIntensityValue(maxIntensityValue)
        setCurrentRotation2(ANGLE_MAX)
        if (angleDiff > 0) return false
      } else {
        newIntensityValue = Math.max(0.1, newValue) // 최소값으로 클램핑
        setIntensityValue(newIntensityValue)
        setCurrentRotation2(valueToAngle(newIntensityValue, minIntensityValue, maxIntensityValue))
      }
    }
    
    // 즉시 필터 업데이트 (드래그 중 실시간 반영)
    syncDialFilterValues(newTremorValue, newIntensityValue)

    return true
  }, [INTENSITY_MAX, INTENSITY_MIN, TREMOR_MAX, TREMOR_MIN, intensityValue, syncDialFilterValues, tremorValue, valueToAngle])

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

  const handleMouseDown = (e: React.MouseEvent, dialNumber: number) => {
    // 애니메이션만 중지, 필터는 유지
    stopAnimation()
    
    if (dialNumber === 1) {
      setIsDragging(true)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setStartAngle(getAngle(centerX, centerY, e.clientX, e.clientY))
    } else {
      setIsDragging2(true)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setStartAngle2(getAngle(centerX, centerY, e.clientX, e.clientY))
    }
    e.preventDefault()
  }

  const handleTouchStart = useCallback((e: React.TouchEvent, dialNumber: number) => {
    stopAnimation()

    const touch = e.touches[0]
    if (!touch) return

    if (dialNumber === 1) {
      setIsDragging(true)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setStartAngle(getAngle(centerX, centerY, touch.clientX, touch.clientY))
    } else {
      setIsDragging2(true)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setStartAngle2(getAngle(centerX, centerY, touch.clientX, touch.clientY))
    }
    e.preventDefault()
  }, [getAngle, stopAnimation])

  const handleDocumentTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return

    if (isDragging) {
      const volumeDial = document.getElementById('tremor-circle')
      if (volumeDial) {
        const rect = volumeDial.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, touch.clientX, touch.clientY)
        let angleDiff = currentAngle - startAngle

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        if (updateTremorValue(angleDiff, 1)) {
          setCurrentRotation(prev => prev + angleDiff)
        }

        setStartAngle(currentAngle)
      }
    }

    if (isDragging2) {
      const volumeDial2 = document.getElementById('tremor-circle-2')
      if (volumeDial2) {
        const rect = volumeDial2.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, touch.clientX, touch.clientY)
        let angleDiff = currentAngle - startAngle2

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        if (updateTremorValue(angleDiff, 2)) {
          setCurrentRotation2(prev => prev + angleDiff)
        }

        setStartAngle2(currentAngle)
      }
    }

    e.preventDefault()
  }, [getAngle, isDragging, isDragging2, startAngle, startAngle2, updateTremorValue])

  const handleDocumentTouchEnd = useCallback(() => {
    setIsDragging(false)
    setIsDragging2(false)
    setTimeout(() => {
      applyFilters()
    }, 10)
    startAnimation()
  }, [applyFilters, startAnimation])

  const handleDocumentMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging) {
      const volumeDial = document.getElementById('tremor-circle')
      if (volumeDial) {
        const rect = volumeDial.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, event.clientX, event.clientY)
        let angleDiff = currentAngle - startAngle

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        if (updateTremorValue(angleDiff, 1)) {
          setCurrentRotation(prev => prev + angleDiff)
        }

        setStartAngle(currentAngle)
      }
    }

    if (isDragging2) {
      const volumeDial2 = document.getElementById('tremor-circle-2')
      if (volumeDial2) {
        const rect = volumeDial2.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const currentAngle = getAngle(centerX, centerY, event.clientX, event.clientY)
        let angleDiff = currentAngle - startAngle2

        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        if (updateTremorValue(angleDiff, 2)) {
          setCurrentRotation2(prev => prev + angleDiff)
        }

        setStartAngle2(currentAngle)
      }
    }
  }, [getAngle, isDragging, isDragging2, startAngle, startAngle2, updateTremorValue])

  const handleDocumentMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsDragging2(false)

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
        {showOverlayPanel && overlay.scope === 'viewport' ? (
          <NextImage
            src={overlaySrc}
            alt=""
            aria-hidden="true"
            width={UI_REFERENCE[overlay.image].width}
            height={UI_REFERENCE[overlay.image].height}
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
                value={overlay.scope}
                onChange={(e) => {
                  const nextScope = e.target.value
                  if (nextScope === 'none' || nextScope === 'artboard' || nextScope === 'viewport') {
                    setOverlay((prev) => ({ ...prev, scope: nextScope }))
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
              <div style={{ marginBottom: 4, opacity: 0.8 }}>Image</div>
              <select
                value={overlay.image}
                onChange={(e) => {
                  const nextImage = e.target.value
                  if (nextImage === 'iphone16_9' || nextImage === 'iphone16_10') {
                    setOverlay((prev) => ({ ...prev, image: nextImage }))
                  }
                }}
                style={{ width: '100%', padding: '6px 8px' }}
              >
                <option value="iphone16_9">{UI_REFERENCE.iphone16_9.label}</option>
                <option value="iphone16_10">{UI_REFERENCE.iphone16_10.label}</option>
              </select>
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
                  setOverlay((prev) => ({ ...prev, opacity: next }))
                }}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        ) : null}

        <div style={{
          width: `${scaledDesignWidth}px`,
          height: `${scaledDesignHeight}px`,
          position: 'relative',
        }}>
          {showOverlayPanel && overlay.scope === 'artboard' ? (
            <NextImage
              src={overlaySrc}
              alt=""
              aria-hidden="true"
              width={UI_REFERENCE[overlay.image].width}
              height={UI_REFERENCE[overlay.image].height}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: overlay.image === 'iphone16_9' ? 'fill' : 'contain',
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
          onClick={() => {
            exportAnimatedSVG()
          }}
          title="애니메이션 SVG 저장"
          aria-label="애니메이션 SVG로 저장"
        >
          <NextImage src="/svg/Gear.svg" alt="설정" width={32} height={32} style={{ width: vwp(32), height: vwp(32) }} />
        </button>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
    </div>
  )
}
