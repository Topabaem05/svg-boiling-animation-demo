"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Download, Play, Square, RotateCcw } from "lucide-react"

export default function SVGBoilingAnimation() {
  const [baseFrequency, setBaseFrequency] = useState(0.025)
  const [scale, setScale] = useState(7.5)
  const animationScale = 0.2 // 고정값으로 설정
  const [animationSpeed, setAnimationSpeed] = useState(100) // milliseconds
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [svgContent, setSvgContent] = useState(`
    <path d="M50,50 L150,50 L150,150 L50,150 Z" fill="#3498db" stroke="#2980b9" strokeWidth="2"/>
    <circle cx="100" cy="100" r="30" fill="#e74c3c" stroke="#c0392b" strokeWidth="2"/>
    <line x1="60" y1="60" x2="140" y2="140" stroke="#f1c40f" strokeWidth="3"/>
  `)
  const [originalViewBox, setOriginalViewBox] = useState("0 0 200 200")
  const [originalWidth, setOriginalWidth] = useState(200)
  const [originalHeight, setOriginalHeight] = useState(200)
  const [scaledViewBox, setScaledViewBox] = useState("0 0 200 200")

  const animatedSvgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationIntervalRef = useRef<number | null>(null)
  const currentIndexRef = useRef(0)

  const offsetArray = [-0.02, 0.01, -0.01, 0.02]

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
    turbulence.setAttribute("baseFrequency", baseFrequency.toString())
    turbulence.setAttribute("numOctaves", "2")
    turbulence.setAttribute("result", "noise")

    const displacement = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap")
    displacement.setAttribute("in", "SourceGraphic")
    displacement.setAttribute("in2", "noise")
    displacement.setAttribute("scale", scale.toString())
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
  }, [baseFrequency, scale])

  const updateAnimation = useCallback(() => {
    const svg = animatedSvgRef.current
    if (!svg) return

    const offset = offsetArray[currentIndexRef.current]
    const newBaseFrequency = baseFrequency + offset * animationScale

    const turbulence = svg.querySelector("feTurbulence")
    if (turbulence) {
      turbulence.setAttribute("baseFrequency", newBaseFrequency.toString())
    }

    currentIndexRef.current = (currentIndexRef.current + 1) % offsetArray.length
  }, [baseFrequency, animationScale])

  const startAnimation = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
    }
    animationIntervalRef.current = window.setInterval(updateAnimation, animationSpeed)
    setIsAnimating(true)
  }

  const stopAnimation = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
    setIsAnimating(false)
  }

  const resetValues = () => {
    setBaseFrequency(0.025)
    setScale(7.5)
    setAnimationSpeed(100)
    stopAnimation()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setOriginalViewBox(viewBox)
          
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
          const img = new Image()
          img.onload = () => {
            // Calculate scaled dimensions to fit within canvas while maintaining aspect ratio
            const canvasSize = 500 // Size of the animation canvas
            let scaledWidth = img.width
            let scaledHeight = img.height
            
            // Scale image to fit within canvas while preserving aspect ratio
            const aspectRatio = img.width / img.height
            if (img.width > img.height) {
              // Width is larger - fit to canvas width
              scaledWidth = canvasSize
              scaledHeight = canvasSize / aspectRatio
            } else {
              // Height is larger or equal - fit to canvas height
              scaledHeight = canvasSize
              scaledWidth = canvasSize * aspectRatio
            }
            
            // Create canvas to get image data
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            canvas.width = scaledWidth
            canvas.height = scaledHeight
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)
            
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
              setOriginalViewBox(`0 0 ${scaledWidth} ${scaledHeight}`)
            }
          }
          img.src = e.target?.result as string
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
      turbulence.setAttribute("baseFrequency", baseFrequency.toString())
      turbulence.setAttribute("numOctaves", "2")
      turbulence.setAttribute("result", "noise")

      const displacement = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap")
      displacement.setAttribute("in", "SourceGraphic")
      displacement.setAttribute("in2", "noise")
      displacement.setAttribute("scale", scale.toString())
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
      const selectedOffsets = [offsetArray[0], offsetArray[1], offsetArray[2]] // Use first 3 offsets

      // Helper function to wait for next animation frame
      const waitForFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

      // Helper function to wait for specified time
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      for (let i = 0; i < frameCount; i++) {
        const offset = selectedOffsets[i]
        const newBaseFrequency = baseFrequency + offset * animationScale

        // Update turbulence in temp SVG only
        const tempTurbulence = tempSvg.querySelector("feTurbulence")
        if (tempTurbulence) {
          tempTurbulence.setAttribute("baseFrequency", newBaseFrequency.toString())
        }

        // Wait for DOM to update
        await waitForFrame()
        await wait(50) // Additional wait to ensure rendering

        // Convert temp SVG to canvas
        const svgData = new XMLSerializer().serializeToString(tempSvg)
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              // 흰색 배경을 300x300 영역에만 적용
              ctx.fillStyle = "white"
              ctx.fillRect(0, 0, 300, 300)
              // SVG를 300x300 영역에 맞춰 그림
              ctx.drawImage(img, 0, 0, 300, 300)

              // Add frame to GIF
              gif.addFrame(canvas, { delay: animationSpeed, copy: true })
              URL.revokeObjectURL(url)
              resolve()
            } catch (error) {
              reject(error)
            }
          }
          img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("Failed to load image"))
          }
          img.src = url
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
    const svg = animatedSvgRef.current
    if (!svg) return

    // Convert animationSpeed to seconds for SVG animation
    const animationDuration = (animationSpeed * offsetArray.length) / 1000

    // Use the same scaled viewBox as the animation canvas
    const exportWidth = 500
    const exportHeight = 500
    const exportViewBox = scaledViewBox

    // Create animated SVG with SMIL animations
    const animatedSvgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${exportViewBox}" width="${exportWidth}" height="${exportHeight}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="boilingFilter" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="turbulence" baseFrequency="${baseFrequency}" numOctaves="2" result="noise">
            <animate attributeName="baseFrequency" 
              values="${baseFrequency + -0.02 * animationScale};${baseFrequency + 0.01 * animationScale};${baseFrequency + -0.01 * animationScale};${baseFrequency + 0.02 * animationScale};${baseFrequency + -0.02 * animationScale}"
              dur="${animationDuration}s" 
              repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
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
    const canvasSize = 500 // Total canvas size
    const aspectRatio = originalWidth / originalHeight
    let scaledWidth = originalWidth
    let scaledHeight = originalHeight
    
    // Scale to fit within canvas while maintaining aspect ratio
    if (originalWidth > canvasSize || originalHeight > canvasSize) {
      if (aspectRatio > 1) {
        // Width is larger
        scaledWidth = canvasSize
        scaledHeight = canvasSize / aspectRatio
      } else {
        // Height is larger or equal
        scaledHeight = canvasSize
        scaledWidth = canvasSize * aspectRatio
      }
    }
    
    // Calculate centered position within canvas
    const offsetX = (canvasSize - scaledWidth) / 2
    const offsetY = (canvasSize - scaledHeight) / 2
    
    // Create viewBox that centers the content
    const newScaledViewBox = `${-offsetX} ${-offsetY} ${canvasSize} ${canvasSize}`
    setScaledViewBox(newScaledViewBox)
  }, [originalWidth, originalHeight])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  useEffect(() => {
    if (isAnimating) {
      startAnimation()
    }
  }, [animationSpeed, updateAnimation])

  useEffect(() => {
    // Auto-start animation on component mount
    startAnimation()

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">

        {/* Animated SVG */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Animated SVG</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-4">
              <svg
                ref={animatedSvgRef}
                xmlns="http://www.w3.org/2000/svg"
                viewBox={scaledViewBox}
                width="500"
                height="500"
                preserveAspectRatio="xMidYMid meet"
                className="border border-gray-200"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          </CardContent>
        </Card>

        {/* File Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Image File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
              Choose Image File (SVG, PNG, JPG)
            </Button>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Animation Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Base Frequency: {baseFrequency.toFixed(3)}</Label>
              <Slider
                value={[baseFrequency]}
                onValueChange={(value) => setBaseFrequency(value[0])}
                min={0.001}
                max={0.05}
                step={0.001}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Scale: {scale.toFixed(1)}</Label>
              <Slider
                value={[scale]}
                onValueChange={(value) => setScale(value[0])}
                min={1}
                max={20}
                step={0.5}
                className="w-full"
              />
            </div>


            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={resetValues} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={isAnimating ? stopAnimation : startAnimation}
                variant={isAnimating ? "destructive" : "default"}
              >
                {isAnimating ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Animate
                  </>
                )}
              </Button>
              <Button onClick={exportAsGIF} disabled={isExporting} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Exporting..." : "Export GIF"}
              </Button>
              <Button onClick={exportAnimatedSVG} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Animated SVG
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
