"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"

export default function SVGBoilingAnimation() {
  const [baseFrequency, setBaseFrequency] = useState(0.001)
  const [scale, setScale] = useState(1.0)
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
  const [tremorValue, setTremorValue] = useState(0.001)
  const [intensityValue, setIntensityValue] = useState(1.0)
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

    const offset = offsetArray[currentIndexRef.current]
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

    currentIndexRef.current = (currentIndexRef.current + 1) % offsetArray.length
  }, [tremorValue, intensityValue, animationScale])

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
  }

  const resetValues = () => {
    setTremorValue(0.001)
    setIntensityValue(1.0)
    setCurrentRotation(0)
    setCurrentRotation2(0)
    setAnimationSpeed(100)
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
            // width가 310을 넘지 않도록 조정
            const maxWidth = 310
            let scaledWidth = img.width
            let scaledHeight = img.height
            
            // width가 310을 넘는 경우 비율을 유지하면서 스케일 조정
            if (img.width > maxWidth) {
              const scaleRatio = maxWidth / img.width
              scaledWidth = maxWidth
              scaledHeight = img.height * scaleRatio
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
      const selectedOffsets = [offsetArray[0], offsetArray[1], offsetArray[2]] // Use first 3 offsets

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
    // Convert animationSpeed to seconds for SVG animation
    const animationDuration = (animationSpeed * offsetArray.length) / 1000

    // Use the same scaled viewBox as the animation canvas
    const exportWidth = 500
    const exportHeight = 500
    const exportViewBox = scaledViewBox

    // 애니메이션 값에서도 항상 양수 유지
    const animatedValues = offsetArray.map(offset => {
      let val = tremorValue + offset * animationScale
      val = Math.max(0.0001, val)
      return val
    }).join(';') + `;${Math.max(0.0001, tremorValue + offsetArray[0] * animationScale)}`

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
    const maxWidth = 310 // 최대 허용 너비
    const viewBoxHeight = 415 // ViewBox 높이
    let scaledWidth = originalWidth
    let scaledHeight = originalHeight
    
    // width가 310을 넘는 경우 비율을 유지하면서 스케일 조정
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
      }
    }
  }, [])

  useEffect(() => {
    if (isAnimating) {
      startAnimation()
    }
  }, [animationSpeed, updateAnimation])

  // 볼륨 다이얼 관련 함수들
  const getAngle = (centerX: number, centerY: number, clientX: number, clientY: number) => {
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI)
  }

  const updateTremorValue = (angleDiff: number, dialNumber = 1) => {
    let newTremorValue = tremorValue
    let newIntensityValue = intensityValue
    
    if (dialNumber === 1) {
      // 떨림 다이얼 (0.001 - 0.050)
      const minTremorValue = 0.001
      const maxTremorValue = 0.050
      const valueRange = maxTremorValue - minTremorValue
      const valueChange = (angleDiff / 360) * valueRange
      const newValue = tremorValue + valueChange
      
      if (newValue <= minTremorValue) {
        newTremorValue = minTremorValue
        setTremorValue(minTremorValue)
        if (angleDiff < 0) return false
      } else if (newValue >= maxTremorValue) {
        newTremorValue = maxTremorValue
        setTremorValue(maxTremorValue)
        if (angleDiff > 0) return false
      } else {
        newTremorValue = Math.max(0.0001, newValue) // 항상 양수 유지
        setTremorValue(newTremorValue)
      }
    } else {
      // 강도 다이얼 (1.0 - 20.0)
      const minIntensityValue = 1.0
      const maxIntensityValue = 20.0
      const valueRange = maxIntensityValue - minIntensityValue
      const valueChange = (angleDiff / 360) * valueRange
      const newValue = intensityValue + valueChange
      
      if (newValue <= minIntensityValue) {
        newIntensityValue = minIntensityValue
        setIntensityValue(minIntensityValue)
        setScale(minIntensityValue)
        if (angleDiff < 0) return false
      } else if (newValue >= maxIntensityValue) {
        newIntensityValue = maxIntensityValue
        setIntensityValue(maxIntensityValue)
        setScale(maxIntensityValue)
        if (angleDiff > 0) return false
      } else {
        newIntensityValue = Math.max(0.1, newValue) // 최소값으로 클램핑
        setIntensityValue(newIntensityValue)
        setScale(newIntensityValue)
      }
    }
    
    // 즉시 필터 업데이트 (드래그 중 실시간 반영)
    const svg = animatedSvgRef.current
    if (svg) {
      const turbulence = svg.querySelector("feTurbulence")
      const displacement = svg.querySelector("feDisplacementMap")
      
      if (turbulence && displacement) {
        if (dialNumber === 1) {
          turbulence.setAttribute("baseFrequency", Math.max(0.0001, newTremorValue).toString())
        } else {
          displacement.setAttribute("scale", newIntensityValue.toString())
        }
      }
    }
    
    return true
  }

  const handleMouseDown = (e: React.MouseEvent, dialNumber: number) => {
    // 애니메이션만 중지, 필터는 유지
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
    setIsAnimating(false)
    
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const volumeDial = document.getElementById('tremor-circle')
      if (volumeDial) {
        const rect = volumeDial.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        
        const currentAngle = getAngle(centerX, centerY, e.clientX, e.clientY)
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
        
        const currentAngle = getAngle(centerX, centerY, e.clientX, e.clientY)
        let angleDiff = currentAngle - startAngle2
        
        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360
        
        if (updateTremorValue(angleDiff, 2)) {
          setCurrentRotation2(prev => prev + angleDiff)
        }
        
        setStartAngle2(currentAngle)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsDragging2(false)
    
    // 드래그 종료 후 전체 필터를 다시 적용하여 지속성 보장
    setTimeout(() => {
      applyFilters()
    }, 10) // 짧은 지연으로 상태 업데이트 완료 후 적용
    
    // 애니메이션 재시작
    startAnimation();
  }

  // 마우스 이벤트 리스너 추가
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove as any)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove as any)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isDragging2, startAngle, startAngle2, tremorValue, intensityValue])

  return (
    <div style={{
      fontFamily: 'Ownglyph_ParkDaHyun, sans-serif',
      backgroundColor: '#FFB784',
      width: '393px',
      height: '852px',
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Canvas Area */}
      <div style={{
        position: 'absolute',
        left: '30px',
        top: '74px',
        width: '349px',
        height: '511px'
      }}>
        <img src="/svg/Rectangle-266.svg" alt="Canvas background" style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 0,
          right: '10px',
          bottom: '30px'
        }} />
        <div style={{
          position: 'absolute',
          left: '3px',
          top: '10px',
          width: '325px',
          height: '445px',
          zIndex: 1
        }}>
          <svg
            ref={animatedSvgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={scaledViewBox}
            width="325"
            height="445"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
      
      {/* 볼륨 다이얼들 */}
      <div style={{
        position: 'absolute',
        left: '50px',
        top: '559px',
        width: '290px',
        height: '167px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* 첫 번째 다이얼 - 떨림 세기 */}
        <div style={{
          width: '130px',
          height: '130px',
          position: 'relative'
        }}>
          {/* Radial Elements */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '85px',
            height: '85px'
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
                    transform: `translate(-50%, -50%) rotate(${angles[i]}deg) translateY(-60px)`
                  }}
                >
                  <img src="/svg/Vector 98.svg" alt="Radial element" style={{ transform: 'scale(1.0)', display: 'block' }} />
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
            width: '85px',
            height: '85px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <img 
              id="tremor-circle"
              src="/svg/Group 241.svg" 
              alt="Tremor circle" 
              style={{
                width: '100%',
                height: '100%',
                cursor: 'grab',
                userSelect: 'none',
                transformOrigin: 'center center',
                transform: `rotate(${currentRotation}deg)`,
                filter: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(e, 1)}
            />
          </div>
        </div>
        
        {/* 두 번째 다이얼 - 효과 강도 */}
        <div style={{
          width: '130px',
          height: '130px',
          position: 'relative'
        }}>
          {/* Radial Elements */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '85px',
            height: '85px'
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
                    transform: `translate(-50%, -50%) rotate(${angles[i]}deg) translateY(-60px)`
                  }}
                >
                  <img src="/svg/Vector 98.svg" alt="Radial element" style={{ transform: 'scale(1.0)', display: 'block' }} />
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
            width: '85px',
            height: '85px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <img 
              id="tremor-circle-2"
              src="/svg/Group 241-4.svg" 
              alt="Intensity circle" 
              style={{
                width: '100%',
                height: '100%',
                cursor: 'grab',
                userSelect: 'none',
                transformOrigin: 'center center',
                transform: `rotate(${currentRotation2}deg)`,
                filter: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(e, 2)}
            />
          </div>
        </div>
      </div>

      {/* 텍스트 라벨들 */}
      <div style={{
        position: 'absolute',
        left: '30px',
        top: '740px',
        fontSize: '25px',
        color: 'rgb(0, 0, 0)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 'normal',
        width: '140px'
      }}>
        떨림 세기 : <span style={{ display: 'inline-block', width: '50px', textAlign: 'left', fontWeight: 'bold' }}>{tremorValue.toFixed(3)}</span>
      </div>
      
      <div style={{
        position: 'absolute',
        left: '220px',
        top: '740px',
        fontSize: '25px',
        color: 'rgb(0, 0, 0)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 'normal',
        width: '140px',
        right: '0px'
      }}>
        세기 강도 : <span style={{ display: 'inline-block', width: '40px', textAlign: 'left', fontWeight: 'bold' }}>{intensityValue.toFixed(1)}</span>
      </div>

      {/* 하단 툴바 */}
      <div style={{
        position: 'absolute',
        left: '0',
        top: '802px',
        width: '393px',
        height: '50px',
        backgroundColor: '#303030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px'
      }}>
        <div 
          style={{
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => fileInputRef.current?.click()}
          title="첨부"
        >
          <img src="/svg/Paperclip.svg" alt="첨부" style={{ width: '32px', height: '32px' }} />
        </div>
        
        <div 
          style={{
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="업로드"
        >
          <img src="/svg/UploadSimple.svg" alt="업로드" style={{ width: '32px', height: '32px' }} />
        </div>
        
        <div 
          style={{
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="설정"
        >
          <img src="/svg/Gear.svg" alt="설정" style={{ width: '32px', height: '32px' }} />
        </div>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
  )
}
