declare module 'gif.js' {
  interface GIFOptions {
    workers?: number
    quality?: number
    width?: number
    height?: number
    workerScript?: string
  }

  interface AddFrameOptions {
    delay?: number
    copy?: boolean
  }

  class GIF {
    constructor(options?: GIFOptions)
    addFrame(canvas: HTMLCanvasElement, options?: AddFrameOptions): void
    on(event: 'finished', callback: (blob: Blob) => void): void
    on(event: 'progress', callback: (progress: number) => void): void
    render(): void
  }

  export = GIF
}

declare module 'imagetracerjs' {
  interface ImageTracerOptions {
    ltres?: number
    qtres?: number
    pathomit?: number
    rightangleenhance?: boolean
    colorsampling?: number
    numberofcolors?: number
    mincolorratio?: number
    colorquantcycles?: number
    scale?: number
    strokewidth?: number
    blurradius?: number
    blurdelta?: number
  }

  class ImageTracer {
    static imagedataToSVG(imageData: ImageData, options?: ImageTracerOptions): string
  }

  export = ImageTracer
}
